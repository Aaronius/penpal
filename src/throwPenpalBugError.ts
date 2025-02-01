const throwPenpalBugError = (description: string) => {
  throw new Error(
    "You've hit a bug in Penpal. Please file an issue with the " +
      'following information: ' +
      description
  );
};

export default throwPenpalBugError;
