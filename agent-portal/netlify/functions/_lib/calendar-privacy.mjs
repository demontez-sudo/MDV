/* A personal block (lunch, training, home life) is tagged with the user it belongs to and is only ever returned to that user. */
export const visibleToUser = (ev, userId) => {
  const owner = ev?.metadata?.private_to_user_id;
  return !owner || owner === userId;
};
