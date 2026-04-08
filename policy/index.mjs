export function adjustPolicy(memory) {
  const history = Array.isArray(memory?.history) ? memory.history : [];

  if (!history.length) {
    return {
      explorationRate: 0.2,
      outreachThreshold: 0.7,
    };
  }

  const successRate =
    history.filter((item) => ['meeting', 'converted'].includes(item?.outcome)).length / history.length;

  return {
    explorationRate: successRate < 0.3 ? 0.4 : 0.2,
    outreachThreshold: successRate > 0.5 ? 0.6 : 0.7,
  };
}
