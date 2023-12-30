const areGlobalsAccessible = () => {
  try {
    clearTimeout(0);
  } catch (e) {
    return false;
  }
  return true;
};

export default areGlobalsAccessible;
