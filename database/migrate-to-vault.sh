#!/usr/bin/env sh
set -eu

# Non-destructive local database-name migration for the Docker Compose stack.
# The source database is never altered or dropped. A populated target is never
# overwritten: it must already contain every source row by primary key.

SOURCE_DATABASE="${SOURCE_DATABASE:-moodeng_multistore}"
TARGET_DATABASE="${TARGET_DATABASE:-vault_multistore}"
PRESERVE_POPULATED_TARGET="${PRESERVE_POPULATED_TARGET:-0}"
REQUIRED_TABLES="users businesses orders order_items products_cache sync_logs"

validate_identifier() {
  case "$1" in
    ''|*[!A-Za-z0-9_]*)
      echo "Invalid MySQL identifier: $1" >&2
      exit 1
      ;;
  esac
}

validate_identifier "$SOURCE_DATABASE"
validate_identifier "$TARGET_DATABASE"
if [ "$PRESERVE_POPULATED_TARGET" != 0 ] && [ "$PRESERVE_POPULATED_TARGET" != 1 ]; then
  echo "PRESERVE_POPULATED_TARGET must be 0 or 1." >&2
  exit 1
fi

mysql_root() {
  docker compose exec -T mysql sh -c \
    'exec mysql --batch --skip-column-names -uroot -p"$MYSQL_ROOT_PASSWORD"'
}

query() {
  printf '%s\n' "$1" | mysql_root
}

database_exists() {
  query "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '$1';"
}

table_exists() {
  query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$1' AND TABLE_NAME = '$2';"
}

row_count() {
  query "SELECT COUNT(*) FROM \`$1\`.\`$2\`;"
}

comparison_columns() {
  case "$1" in
    users) echo "name email password_hash role created_at updated_at" ;;
    businesses) echo "name business_type api_url status last_checked_at created_at updated_at" ;;
    orders) echo "order_no customer_name customer_email customer_phone shipping_address_line1 shipping_address_line2 shipping_district shipping_province shipping_postal_code shipping_country subtotal shipping_fee discount total status created_at updated_at" ;;
    order_items) echo "order_id product_id business business_name product_name category image_url unit_price quantity line_total created_at" ;;
    products_cache) echo "business_id external_product_id name category price stock unit status image_url attributes updated_at" ;;
    sync_logs) echo "business_id status products_received message synced_at" ;;
    *) return 1 ;;
  esac
}

if [ "$(database_exists "$SOURCE_DATABASE")" -ne 1 ]; then
  echo "Source database $SOURCE_DATABASE does not exist." >&2
  exit 1
fi

for table in $REQUIRED_TABLES; do
  if [ "$(table_exists "$SOURCE_DATABASE" "$table")" -ne 1 ]; then
    echo "Source database is missing required table: $table" >&2
    exit 1
  fi
done

target_exists="$(database_exists "$TARGET_DATABASE")"
target_table_count=0
if [ "$target_exists" -eq 1 ]; then
  target_table_count="$(query "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$TARGET_DATABASE';")"
fi

if [ "$target_exists" -eq 0 ] || [ "$target_table_count" -eq 0 ]; then
  echo "Creating and copying $SOURCE_DATABASE to $TARGET_DATABASE..."
  query "CREATE DATABASE IF NOT EXISTS \`$TARGET_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

  # The target is known to be empty. --skip-add-drop-table guarantees the dump
  # contains no table deletion statements while preserving indexes and FKs.
  docker compose exec -T mysql sh -c \
    'exec mysqldump --single-transaction --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --skip-add-drop-table --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$1"' \
    sh "$SOURCE_DATABASE" \
    | docker compose exec -T mysql sh -c \
      'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$1"' sh "$TARGET_DATABASE"
else
  echo "$TARGET_DATABASE already contains tables; verifying without overwriting it..."
  for table in $REQUIRED_TABLES; do
    if [ "$(table_exists "$TARGET_DATABASE" "$table")" -ne 1 ]; then
      echo "Target database is populated but missing required table: $table" >&2
      exit 1
    fi

    missing="$(query "SELECT COUNT(*) FROM \`$SOURCE_DATABASE\`.\`$table\` src LEFT JOIN \`$TARGET_DATABASE\`.\`$table\` dst ON dst.id = src.id WHERE dst.id IS NULL;")"
    if [ "$missing" -ne 0 ]; then
      echo "Target table $table is missing $missing source row(s); refusing to merge into a populated target." >&2
      exit 1
    fi

    difference_predicate=''
    for column in $(comparison_columns "$table"); do
      clause="NOT (dst.\`$column\` <=> src.\`$column\`)"
      if [ -n "$difference_predicate" ]; then
        difference_predicate="$difference_predicate OR $clause"
      else
        difference_predicate="$clause"
      fi
    done
    conflicts="$(query "SELECT COUNT(*) FROM \`$SOURCE_DATABASE\`.\`$table\` src JOIN \`$TARGET_DATABASE\`.\`$table\` dst ON dst.id = src.id WHERE $difference_predicate;")"
    if [ "$conflicts" -ne 0 ]; then
      if [ "$PRESERVE_POPULATED_TARGET" -eq 1 ]; then
        echo "Target table $table has $conflicts changed source row(s); preserving the populated VAULT version." >&2
      else
        echo "Target table $table has $conflicts conflicting source row(s); inspect them before rerunning with PRESERVE_POPULATED_TARGET=1." >&2
        exit 1
      fi
    fi
  done
fi

# The historical source schema predates order ownership. Add the nullable
# ownership relation after copying, but never attempt to add it twice.
ownership_column="$(query "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '$TARGET_DATABASE' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'user_id';")"
if [ "$ownership_column" -eq 0 ]; then
  if [ "$TARGET_DATABASE" != 'vault_multistore' ]; then
    echo "Ownership migration is pinned to vault_multistore; refusing unexpected target $TARGET_DATABASE." >&2
    exit 1
  fi
  script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  mysql_root < "$script_dir/migrations/002_order_ownership.sql"
fi

app_user="$(docker compose exec -T mysql sh -c 'printf %s "$MYSQL_USER"')"
validate_identifier "$app_user"
query "GRANT ALL PRIVILEGES ON \`$TARGET_DATABASE\`.* TO '$app_user'@'%'; FLUSH PRIVILEGES;"

printf '%-22s %12s %12s\n' TABLE SOURCE TARGET
for table in $REQUIRED_TABLES; do
  source_count="$(row_count "$SOURCE_DATABASE" "$table")"
  target_count="$(row_count "$TARGET_DATABASE" "$table")"
  printf '%-22s %12s %12s\n' "$table" "$source_count" "$target_count"
  if [ "$target_count" -lt "$source_count" ]; then
    echo "Target row count is lower than source for $table." >&2
    exit 1
  fi
done

echo "Migration verification complete. $SOURCE_DATABASE was preserved."
