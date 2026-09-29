import { ReadyTestimonial, TestimonialAsset } from '../../types';

export type ReadyAssetItem = {
  testimonial: ReadyTestimonial;
  asset: TestimonialAsset;
};

export type ReadyGalleryItem = {
  id: string;
  testimonial: ReadyTestimonial;
  assets: TestimonialAsset[];
  primaryAsset: TestimonialAsset;
  isPhotoCatalog: boolean;
};

export const normalizeReadyKey = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();

export const splitReadyProcedures = (value?: string | null) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

export const isPhotographyCreative = (creativeType?: string | null) =>
  normalizeReadyKey(creativeType) === 'fotografia';

export const buildReadyGalleryItems = (testimonials: ReadyTestimonial[]): ReadyGalleryItem[] =>
  testimonials.flatMap<ReadyGalleryItem>(testimonial => {
    if (testimonial.assets.length === 0) return [];
    return [{
      id: testimonial.id,
      testimonial,
      assets: testimonial.assets,
      primaryAsset: testimonial.assets[0],
      isPhotoCatalog: isPhotographyCreative(testimonial.creativeType) || testimonial.assets.length > 1,
    }];
  });

export const scoreReadyRecommendation = (current: ReadyGalleryItem, candidate: ReadyGalleryItem) => {
  if (candidate.id === current.id) return Number.NEGATIVE_INFINITY;

  const currentGender = normalizeReadyKey(current.testimonial.patientGender);
  const candidateGender = normalizeReadyKey(candidate.testimonial.patientGender);
  const currentProcedures = splitReadyProcedures(current.testimonial.patientProcedure).map(normalizeReadyKey);
  const candidateProcedures = splitReadyProcedures(candidate.testimonial.patientProcedure).map(normalizeReadyKey);
  const hasProcedureMatch = currentProcedures.some(proc => candidateProcedures.includes(proc));
  const sameGender = Boolean(currentGender && candidateGender && currentGender === candidateGender);
  const currentAge = current.testimonial.patientAge;
  const candidateAge = candidate.testimonial.patientAge;
  const ageDiff = typeof currentAge === 'number' && typeof candidateAge === 'number'
    ? Math.abs(currentAge - candidateAge)
    : 99;

  let score = 0;
  if (sameGender) score += 1000;
  if (hasProcedureMatch) score += 500;
  score += Math.max(0, 120 - ageDiff * 6);
  if (candidate.testimonial.caseId !== current.testimonial.caseId) score += 50;
  else score -= 100;
  return score;
};

export const sortReadyRecommendations = (items: ReadyGalleryItem[], current: ReadyGalleryItem) =>
  items
    .filter(item => item.id !== current.id)
    .sort((a, b) => {
      const scoreDiff = scoreReadyRecommendation(current, b) - scoreReadyRecommendation(current, a);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.testimonial.patientName).localeCompare(String(b.testimonial.patientName), 'pt-BR');
    });
