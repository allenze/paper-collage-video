const TAU = Math.PI * 2;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

const hashSeed = (seed, salt) => {
  let value = (seed >>> 0) ^ 2166136261;
  for (const character of String(salt)) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  return value >>> 0;
};

const mulberry32 = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
};

const between = (random, [minimum, maximum]) =>
  minimum + (maximum - minimum) * random();

const edgePoint = (amount) => {
  const position = (amount % 1) * 4;
  if (position < 1) return {x: position, y: 0};
  if (position < 2) return {x: 1, y: position - 1};
  if (position < 3) return {x: 3 - position, y: 1};
  return {x: 0, y: 4 - position};
};

export const resolveMotifFieldInstances = (node) => {
  const random = mulberry32(hashSeed(node.seed, node.id));
  const count = Math.max(0, Math.min(64, Math.floor(node.count)));
  const safeArea = node.safeArea ?? {x: 0, y: 0, width: 1, height: 1};
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  return Array.from({length: count}, (_, index) => {
    let point;
    if (node.distribution === 'grid') {
      const column = index % columns;
      const row = Math.floor(index / columns);
      point = {
        x: (column + 0.5 + (random() - 0.5) * 0.28) / columns,
        y: (row + 0.5 + (random() - 0.5) * 0.28) / rows,
      };
    } else if (node.distribution === 'edge') {
      point = edgePoint((index + random() * 0.5) / Math.max(1, count));
    } else {
      point = {x: random(), y: random()};
    }
    return {
      id: `${node.id}-motif-${index + 1}`,
      src: node.motifs[index % node.motifs.length].src,
      x: safeArea.x + point.x * safeArea.width,
      y: safeArea.y + point.y * safeArea.height,
      scale: between(random, node.variation.scale),
      rotation: between(random, node.variation.rotation),
      opacity: between(random, node.variation.opacity),
      phase: random(),
    };
  });
};

export const resolveMotifFieldMotion = ({instance, preset, progress, cycles}) => {
  const phase = (progress * cycles + instance.phase) % 1;
  const wave = Math.sin(phase * TAU);
  const cosine = Math.cos(phase * TAU);
  switch (preset) {
    case 'fall-drift':
      return {x: wave * 0.018, y: phase * 0.16 - 0.08, rotation: wave * 12, scale: 1};
    case 'burst': {
      const angle = instance.phase * TAU;
      const radius = Math.sin(clamp01(progress) * Math.PI) * 0.09;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        rotation: progress * 90,
        scale: 0.82 + Math.sin(clamp01(progress) * Math.PI) * 0.28,
      };
    }
    case 'orbit':
      return {x: cosine * 0.035, y: wave * 0.035, rotation: phase * 360, scale: 1};
    case 'drift':
    default:
      return {x: wave * 0.025, y: cosine * 0.016, rotation: wave * 7, scale: 1};
  }
};
