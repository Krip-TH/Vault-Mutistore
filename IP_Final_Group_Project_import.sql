-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: vault_multistore
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `vault_multistore`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `vault_multistore` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `vault_multistore`;

--
-- Table structure for table `businesses`
--

DROP TABLE IF EXISTS `businesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `businesses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `business_type` varchar(50) NOT NULL,
  `api_url` varchar(2048) DEFAULT NULL,
  `status` enum('active','inactive','unavailable') NOT NULL DEFAULT 'inactive',
  `last_checked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_businesses_business_type` (`business_type`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `businesses`
--

LOCK TABLES `businesses` WRITE;
/*!40000 ALTER TABLE `businesses` DISABLE KEYS */;
INSERT INTO `businesses` VALUES (1,'Door Business','Door',NULL,'inactive',NULL,'2026-09-19 15:28:56','2026-09-19 15:28:56'),(2,'Electrical Plug Business','Electrical Plug',NULL,'inactive',NULL,'2026-09-19 15:28:56','2026-09-19 15:28:56'),(3,'Brandname Business','Brandname',NULL,'inactive',NULL,'2026-09-19 15:28:56','2026-09-19 15:28:56'),(4,'Clothing Business','Clothing',NULL,'inactive',NULL,'2026-09-19 15:28:56','2026-09-19 15:28:56'),(5,'Powerbank Business','Powerbank',NULL,'inactive',NULL,'2026-09-19 15:28:56','2026-09-19 15:28:56'),(6,'Projector Business','Projector',NULL,'inactive',NULL,'2026-09-19 15:28:56','2026-09-19 15:28:56');
/*!40000 ALTER TABLE `businesses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `product_id` varchar(255) NOT NULL,
  `business` varchar(50) NOT NULL,
  `business_name` varchar(120) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `category` varchar(120) DEFAULT NULL,
  `image_url` varchar(2048) DEFAULT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `quantity` int unsigned NOT NULL,
  `line_total` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_business_product` (`business`,`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (1,1,'minimal-ash-interior-door','door','Door','Minimal Ash Interior Door','Interior Doors','https://raw.githubusercontent.com/Krip-TH/ImperialWood-Mobile-App/refs/heads/main/assets/products/minimal-ash-interior-door.jpg',15900.00,1,15900.00,'2026-09-19 15:38:23'),(2,1,'premium-teak-glass-panel-door','door','Door','Premium Teak Glass Panel Door','Glass Panel Doors','https://raw.githubusercontent.com/Krip-TH/ImperialWood-Mobile-App/refs/heads/main/assets/products/premium-teak-glass-panel-door.jpg',29000.00,1,29000.00,'2026-09-19 15:38:23'),(3,2,'modern-walnut-entrance-door','door','Door','Modern Walnut Entrance Door','Modern Doors','https://raw.githubusercontent.com/Krip-TH/ImperialWood-Mobile-App/refs/heads/main/assets/products/modern-walnut-entrance-door.jpg',20000.00,1,20000.00,'2026-09-19 15:49:41'),(4,3,'premium-teak-glass-panel-door','door','Door','Premium Teak Glass Panel Door','Glass Panel Doors','https://raw.githubusercontent.com/Krip-TH/ImperialWood-Mobile-App/refs/heads/main/assets/products/premium-teak-glass-panel-door.jpg',29000.00,1,29000.00,'2026-09-19 15:56:14');
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_no` varchar(32) NOT NULL,
  `customer_name` varchar(160) NOT NULL,
  `customer_email` varchar(254) NOT NULL,
  `customer_phone` varchar(40) NOT NULL,
  `shipping_address_line1` varchar(255) NOT NULL,
  `shipping_address_line2` varchar(255) DEFAULT NULL,
  `shipping_district` varchar(120) NOT NULL,
  `shipping_province` varchar(120) NOT NULL,
  `shipping_postal_code` varchar(20) NOT NULL,
  `shipping_country` varchar(120) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `shipping_fee` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL,
  `status` enum('pending','confirmed','processing','shipped','completed','cancelled') NOT NULL DEFAULT 'confirmed',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_order_no` (`order_no`),
  KEY `idx_orders_customer_email_created` (`customer_email`,`created_at`),
  KEY `idx_orders_status_created` (`status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'MDG-20260919-BAF9D5','Krip Topongkasem','kripzaza@gmail.com','065-239-6211','97/56 suvinam',NULL,'meuang phuket','phuket','83000','Thailand',44900.00,0.00,0.00,44900.00,'confirmed','2026-09-19 15:38:23','2026-09-19 15:38:23'),(2,'MDG-20260919-62A3D6','Order History Integration Test','orders-test@example.com','+66 81 234 5678','88 Integration Test Road',NULL,'Watthana','Bangkok','10110','Thailand',20000.00,0.00,0.00,20000.00,'confirmed','2026-09-19 15:49:41','2026-09-19 15:49:41'),(3,'MDG-20260919-B5BF72','a¶ÔJay Ponsakorn','jay@gmail.com','024-854-9671','Ucity',NULL,'space','mars','7000','Newzeeland',29000.00,0.00,0.00,29000.00,'confirmed','2026-09-19 15:56:14','2026-09-19 15:56:14');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products_cache`
--

DROP TABLE IF EXISTS `products_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products_cache` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `external_product_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(120) NOT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `stock` int NOT NULL DEFAULT '0',
  `unit` varchar(50) NOT NULL DEFAULT 'pcs',
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `image_url` varchar(2048) DEFAULT NULL,
  `attributes` json DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_cache_business_product` (`business_id`,`external_product_id`),
  CONSTRAINT `fk_products_cache_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products_cache`
--

LOCK TABLES `products_cache` WRITE;
/*!40000 ALTER TABLE `products_cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `products_cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sync_logs`
--

DROP TABLE IF EXISTS `sync_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sync_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `status` enum('success','failed','partial') NOT NULL,
  `products_received` int unsigned NOT NULL DEFAULT '0',
  `message` text,
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sync_logs_business_synced` (`business_id`,`synced_at`),
  CONSTRAINT `fk_sync_logs_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sync_logs`
--

LOCK TABLES `sync_logs` WRITE;
/*!40000 ALTER TABLE `sync_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `sync_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL,
  `email` varchar(254) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('customer','admin') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Moodeng Admin','admin@moodeng.com','$2a$10$6waAXvUSTM0TEJrtSHWvs.Z5PDgC7EgAinaJuae0q.xpv7ZHy87za','admin','2026-09-20 08:19:59','2026-09-20 08:19:59'),(2,'Krip Topongkasem','kripzaza@gmail.com','$2a$10$pY2J5/N1.CXwFZFRqLr4TeMGGfQUMDpu7zAGEpbQqgTFNpgCe7hOy','customer','2026-09-20 08:21:41','2026-09-20 08:21:41');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-20  9:16:01

