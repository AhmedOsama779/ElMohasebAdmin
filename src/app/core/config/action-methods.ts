// The HTTP method of each admin action, as shown in Swagger.
// If a call answers "405 Method Not Allowed", change the word here and nothing else.
export const ACTION_METHOD = {
  role: 'PATCH',
  block: 'PATCH',
  categoryStatus: 'PATCH',
  deleteService: 'DELETE',
  deleteLocation: 'DELETE',
  deletePhone: 'DELETE',
} as const;