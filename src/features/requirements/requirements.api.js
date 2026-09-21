/**
 * Requirements API layer — the only file that knows these endpoint URLs.
 */
import { api } from '../../lib/axios.js';

/** The whole board in one call: `{ stages, requirements, truncated }`. */
export async function getBoard(params) {
  const { data } = await api.get('/requirements/board', { params });
  return data.data;
}

/** One card with its stage history and every update written on it. */
export async function getRequirement(id) {
  const { data } = await api.get(`/requirements/${id}`);
  return data.data;
}

/** Active coordinators — for the "assign coordinators" picker and the filter. */
export async function listRequirementCoordinators() {
  const { data } = await api.get('/requirements/coordinators');
  return data.data; // [{ _id, name }]
}

export async function createRequirement(payload) {
  const { data } = await api.post('/requirements', payload);
  return data.data;
}

export async function updateRequirement(id, payload) {
  const { data } = await api.patch(`/requirements/${id}`, payload);
  return data.data;
}

export async function moveRequirement(id, stage) {
  const { data } = await api.patch(`/requirements/${id}/stage`, { stage });
  return data.data;
}

export async function deleteRequirement(id) {
  const { data } = await api.delete(`/requirements/${id}`);
  return data.data;
}

// ---- stages ---------------------------------------------------------------------------

export async function createStage(payload) {
  const { data } = await api.post('/requirements/stages', payload);
  return data.data;
}

export async function updateStage(id, payload) {
  const { data } = await api.patch(`/requirements/stages/${id}`, payload);
  return data.data;
}

export async function deleteStage(id) {
  const { data } = await api.delete(`/requirements/stages/${id}`);
  return data.data;
}

export async function reorderStages(ids) {
  const { data } = await api.put('/requirements/stages/order', { ids });
  return data.data;
}

/** Only accepted on an empty board — see requirementStage.service.js. */
export async function createSuggestedStages() {
  const { data } = await api.post('/requirements/stages/defaults');
  return data.data;
}

// ---- candidates -----------------------------------------------------------------------

export async function addCandidate(requirementId, payload) {
  const { data } = await api.post(`/requirements/${requirementId}/candidates`, payload);
  return data.data;
}

export async function updateCandidate(requirementId, candidateId, payload) {
  const { data } = await api.patch(`/requirements/${requirementId}/candidates/${candidateId}`, payload);
  return data.data;
}

export async function removeCandidate(requirementId, candidateId) {
  const { data } = await api.delete(`/requirements/${requirementId}/candidates/${candidateId}`);
  return data.data;
}
