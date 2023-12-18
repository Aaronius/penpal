const areGlobalsAccessible = () => {
  try {
    clearTimeout();
  } catch (e) {
    return false;
  }
  return true;
};

export default areGlobalsAccessible;
