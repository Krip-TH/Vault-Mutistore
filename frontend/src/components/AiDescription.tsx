import { useEffect, useState } from 'react';
import type { Product } from '../types/product';
import { fetchAiDescription } from '../ai/aiApi';
import { textValue } from '../utils/product';

interface Props {
  product: Product;
}

const MIN_DESCRIPTION_LENGTH = 30;

export default function AiDescription({ product }: Props) {
  const hasRealDescription = textValue(product.description).length >= MIN_DESCRIPTION_LENGTH;
  const [description, setDescription] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (hasRealDescription) return;
    let active = true;
    setDescription(null);
    fetchAiDescription(product.id, product.business)
      .then(response => { if (active) setDescription(response.description); })
      .catch(() => {
        // AI features must never break the page: fail silently and hide this section.
        if (active) setAvailable(false);
      });
    return () => { active = false; };
  }, [hasRealDescription, product.business, product.id]);

  if (hasRealDescription || !available || !description) return null;

  return (
    <div className="ai-description">
      <span className="ai-description-label"><span aria-hidden="true">✦</span> AI-generated description</span>
      <p>{description}</p>
    </div>
  );
}
