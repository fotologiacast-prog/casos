import { CasePatient } from '../types';

export const slugifyPatientName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'paciente';

const comparePatientsForSlug = (a: CasePatient, b: CasePatient) => {
  const aTime = a.createdAt?.getTime() || 0;
  const bTime = b.createdAt?.getTime() || 0;
  return aTime - bTime || a.id.localeCompare(b.id);
};

export const getPatientSlug = (patient: CasePatient, patients: CasePatient[]) => {
  const baseSlug = slugifyPatientName(patient.name);
  const sameNamePatients = patients
    .filter(item => slugifyPatientName(item.name) === baseSlug)
    .sort(comparePatientsForSlug);

  if (sameNamePatients[0]?.id === patient.id) return baseSlug;
  return `${baseSlug}--${patient.id.slice(0, 8)}`;
};

export const findPatientBySlug = (slug: string, patients: CasePatient[]) => {
  const decodedSlug = decodeURIComponent(slug).toLowerCase();
  return patients.find(patient => getPatientSlug(patient, patients) === decodedSlug) || null;
};

export const buildPatientHash = (token: string, patient?: CasePatient | null, patients: CasePatient[] = []) => {
  const base = `#/casos/${encodeURIComponent(token)}`;
  return patient ? `${base}/${getPatientSlug(patient, patients)}` : base;
};
