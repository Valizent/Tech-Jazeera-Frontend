import { api } from '../../lib/axios.js';

export async function listOutsourcedEmployees({ search, workerType } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (workerType) params.set('workerType', workerType);
  const { data } = await api.get(`/outsourced-employees?${params.toString()}`);
  return data.data;
}

export async function getOutsourcedEmployee(id) {
  const { data } = await api.get(`/outsourced-employees/${id}`);
  return data.data;
}

export async function createOutsourcedEmployee(employee) {
  const { data } = await api.post('/outsourced-employees', employee);
  return data.data;
}

export async function updateOutsourcedEmployee(id, employee) {
  const { data } = await api.patch(`/outsourced-employees/${id}`, employee);
  return data.data;
}

export async function deleteOutsourcedEmployee(id) {
  await api.delete(`/outsourced-employees/${id}`);
}
