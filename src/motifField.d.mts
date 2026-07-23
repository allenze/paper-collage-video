export type MotifFieldInstance = {
  id: string;
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  phase: number;
};

export declare const resolveMotifFieldInstances: (
  node: {
    id: string;
    seed: number;
    count: number;
    motifs: Array<{id: string; src: string}>;
    distribution: 'scattered' | 'grid' | 'edge';
    safeArea?: {x: number; y: number; width: number; height: number};
    variation: {
      scale: [number, number];
      rotation: [number, number];
      opacity: [number, number];
    };
  },
) => MotifFieldInstance[];

export declare const resolveMotifFieldMotion: (input: {
  instance: MotifFieldInstance;
  preset: 'drift' | 'fall-drift' | 'burst' | 'orbit';
  progress: number;
  cycles: number;
}) => {x: number; y: number; rotation: number; scale: number};
