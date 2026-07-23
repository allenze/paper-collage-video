import sharp from 'sharp';

export const DEFAULT_ALPHA_BAND_THRESHOLDS = Object.freeze({
  lowAlphaMinimum: 4,
  lowAlphaMaximum: 96,
  minimumRunPixels: 24,
  minimumRunRatio: 0.42,
  warningRunRatio: 0.75,
  maximumBandThicknessRatio: 0.025,
  boundaryToleranceRatio: 0.012,
  rectangleMinimumSeparationRatio: 0.08,
});

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const longestLowAlphaRun = ({
  data,
  channels,
  width,
  height,
  orientation,
  coordinate,
  thresholds,
}) => {
  const length = orientation === 'horizontal' ? width : height;
  let bestStart = 0;
  let bestLength = 0;
  let currentStart = 0;
  let currentLength = 0;
  for (let axis = 0; axis < length; axis += 1) {
    const x = orientation === 'horizontal' ? axis : coordinate;
    const y = orientation === 'horizontal' ? coordinate : axis;
    const alpha = data[(y * width + x) * channels + 3];
    if (
      alpha >= thresholds.lowAlphaMinimum &&
      alpha <= thresholds.lowAlphaMaximum
    ) {
      if (currentLength === 0) currentStart = axis;
      currentLength += 1;
      if (currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
    } else {
      currentLength = 0;
    }
  }
  return {start: bestStart, end: bestStart + bestLength - 1, length: bestLength};
};

const overlapRatio = (left, right) => {
  const overlap = Math.max(
    0,
    Math.min(left.end, right.end) - Math.max(left.start, right.start) + 1,
  );
  return overlap / Math.max(1, Math.min(left.length, right.length));
};

const collectRawCandidates = ({
  data,
  info,
  orientation,
  thresholds,
}) => {
  const count = orientation === 'horizontal' ? info.height : info.width;
  const axisLength = orientation === 'horizontal' ? info.width : info.height;
  const candidates = [];
  for (let coordinate = 0; coordinate < count; coordinate += 1) {
    const run = longestLowAlphaRun({
      data,
      channels: info.channels,
      width: info.width,
      height: info.height,
      orientation,
      coordinate,
      thresholds,
    });
    if (
      run.length >= thresholds.minimumRunPixels &&
      run.length / axisLength >= thresholds.minimumRunRatio
    ) {
      candidates.push({coordinate, ...run});
    }
  }
  return candidates;
};

const mergeCandidates = ({candidates, orientation, width, height}) => {
  const groups = [];
  for (const candidate of candidates) {
    const previous = groups.at(-1);
    if (
      previous &&
      candidate.coordinate === previous.coordinateEnd + 1 &&
      overlapRatio(candidate, previous.last) >= 0.7
    ) {
      previous.rows.push(candidate);
      previous.coordinateEnd = candidate.coordinate;
      previous.last = candidate;
    } else {
      groups.push({
        orientation,
        coordinateStart: candidate.coordinate,
        coordinateEnd: candidate.coordinate,
        rows: [candidate],
        last: candidate,
      });
    }
  }
  return groups.map(({rows, last: _last, ...group}, index) => {
    const start = median(rows.map((row) => row.start));
    const end = median(rows.map((row) => row.end));
    const length = Math.max(0, end - start + 1);
    const axisLength = orientation === 'horizontal' ? width : height;
    const crossLength = orientation === 'horizontal' ? height : width;
    const thickness = group.coordinateEnd - group.coordinateStart + 1;
    return {
      id: `${orientation}-${index + 1}`,
      orientation,
      coordinateStart: group.coordinateStart,
      coordinateEnd: group.coordinateEnd,
      coordinate: Math.round((group.coordinateStart + group.coordinateEnd) / 2),
      spanStart: start,
      spanEnd: end,
      runPixels: length,
      runRatio: length / Math.max(1, axisLength),
      thicknessPixels: thickness,
      thicknessRatio: thickness / Math.max(1, crossLength),
    };
  });
};

const scaleRect = (rect, from, to) => ({
  left: rect.left * to.width / from.width,
  top: rect.top * to.height / from.height,
  width: rect.width * to.width / from.width,
  height: rect.height * to.height / from.height,
});

const correlationFor = ({
  candidate,
  width,
  height,
  regions,
  thresholds,
}) => {
  const crossLength =
    candidate.orientation === 'horizontal' ? height : width;
  const axisLength =
    candidate.orientation === 'horizontal' ? width : height;
  const tolerance = Math.max(
    2,
    Math.round(crossLength * thresholds.boundaryToleranceRatio),
  );
  const correlations = [];
  if (
    candidate.coordinateStart <= tolerance ||
    candidate.coordinateEnd >= crossLength - 1 - tolerance
  ) {
    correlations.push({
      kind: 'canvas-boundary',
      edge: candidate.coordinateStart <= tolerance ? 'start' : 'end',
      distancePixels: Math.min(
        candidate.coordinateStart,
        crossLength - 1 - candidate.coordinateEnd,
      ),
    });
  }
  for (const region of regions) {
    const edges = candidate.orientation === 'horizontal'
      ? [
          {edge: 'top', coordinate: region.rect.top},
          {edge: 'bottom', coordinate: region.rect.top + region.rect.height},
        ]
      : [
          {edge: 'left', coordinate: region.rect.left},
          {edge: 'right', coordinate: region.rect.left + region.rect.width},
        ];
    const regionStart = candidate.orientation === 'horizontal'
      ? region.rect.left
      : region.rect.top;
    const regionEnd = candidate.orientation === 'horizontal'
      ? region.rect.left + region.rect.width
      : region.rect.top + region.rect.height;
    const overlap = Math.max(
      0,
      Math.min(candidate.spanEnd, regionEnd) -
        Math.max(candidate.spanStart, regionStart),
    );
    for (const edge of edges) {
      const distance = Math.abs(candidate.coordinate - edge.coordinate);
      if (
        distance <= tolerance &&
        overlap / Math.max(1, Math.min(candidate.runPixels, regionEnd - regionStart)) >= 0.55
      ) {
        correlations.push({
          kind: region.kind,
          id: region.id,
          edge: edge.edge,
          distancePixels: distance,
        });
      }
    }
  }
  return {
    tolerancePixels: tolerance,
    axisLength,
    correlations,
  };
};

const markRectangularSets = ({candidates, width, height, thresholds}) => {
  const horizontal = candidates.filter(
    (candidate) =>
      candidate.orientation === 'horizontal' &&
      candidate.thicknessRatio <= thresholds.maximumBandThicknessRatio,
  );
  const vertical = candidates.filter(
    (candidate) =>
      candidate.orientation === 'vertical' &&
      candidate.thicknessRatio <= thresholds.maximumBandThicknessRatio,
  );
  const tolerance = Math.max(
    3,
    Math.round(Math.min(width, height) * thresholds.boundaryToleranceRatio),
  );
  const marked = new Set();
  for (let firstH = 0; firstH < horizontal.length; firstH += 1) {
    for (let secondH = firstH + 1; secondH < horizontal.length; secondH += 1) {
      const top = horizontal[firstH];
      const bottom = horizontal[secondH];
      if (
        Math.abs(bottom.coordinate - top.coordinate) <
        height * thresholds.rectangleMinimumSeparationRatio
      ) continue;
      for (let firstV = 0; firstV < vertical.length; firstV += 1) {
        for (let secondV = firstV + 1; secondV < vertical.length; secondV += 1) {
          const left = vertical[firstV];
          const right = vertical[secondV];
          if (
            Math.abs(right.coordinate - left.coordinate) <
            width * thresholds.rectangleMinimumSeparationRatio
          ) continue;
          const horizontalContainsVertical =
            left.coordinate >= top.spanStart - tolerance &&
            right.coordinate <= top.spanEnd + tolerance &&
            left.coordinate >= bottom.spanStart - tolerance &&
            right.coordinate <= bottom.spanEnd + tolerance;
          const verticalContainsHorizontal =
            top.coordinate >= left.spanStart - tolerance &&
            bottom.coordinate <= left.spanEnd + tolerance &&
            top.coordinate >= right.spanStart - tolerance &&
            bottom.coordinate <= right.spanEnd + tolerance;
          if (horizontalContainsVertical && verticalContainsHorizontal) {
            [top, bottom, left, right].forEach(({id}) => marked.add(id));
          }
        }
      }
    }
  }
  return marked;
};

export const analyzeAlphaBandPixels = ({
  data,
  info,
  regions = [],
  thresholds = DEFAULT_ALPHA_BAND_THRESHOLDS,
  label = 'original',
}) => {
  const horizontal = mergeCandidates({
    candidates: collectRawCandidates({
      data,
      info,
      orientation: 'horizontal',
      thresholds,
    }),
    orientation: 'horizontal',
    width: info.width,
    height: info.height,
  });
  const vertical = mergeCandidates({
    candidates: collectRawCandidates({
      data,
      info,
      orientation: 'vertical',
      thresholds,
    }),
    orientation: 'vertical',
    width: info.width,
    height: info.height,
  });
  const candidates = [...horizontal, ...vertical];
  const rectangular = markRectangularSets({
    candidates,
    width: info.width,
    height: info.height,
    thresholds,
  });
  const diagnostics = candidates.map((candidate) => {
    const correlation = correlationFor({
      candidate,
      width: info.width,
      height: info.height,
      regions,
      thresholds,
    });
    const thin =
      candidate.thicknessRatio <= thresholds.maximumBandThicknessRatio;
    const boundaryCorrelated = correlation.correlations.length > 0;
    const rectangleDetected = rectangular.has(candidate.id);
    let severity = 'info';
    let classification = 'normal-contour-or-soft-shadow';
    if (!thin) {
      classification = 'broad-soft-transition';
    } else if (rectangleDetected) {
      severity = 'error';
      classification = 'rectangular-alpha-residue';
    } else if (
      boundaryCorrelated &&
      candidate.runRatio >= thresholds.minimumRunRatio
    ) {
      severity = 'error';
      classification = 'boundary-correlated-alpha-band';
    } else if (candidate.runRatio >= thresholds.warningRunRatio) {
      severity = 'warning';
      classification = 'long-straight-alpha-band-unconfirmed';
    }
    return {
      ...candidate,
      ...correlation,
      thin,
      rectangleDetected,
      severity,
      classification,
    };
  });
  const failures = diagnostics
    .filter(({severity}) => severity === 'error')
    .map((diagnostic) => ({
      id: diagnostic.id,
      message:
        `${label} ${diagnostic.orientation} low-alpha band at ` +
        `${diagnostic.coordinateStart}-${diagnostic.coordinateEnd}px ` +
        `spans ${diagnostic.spanStart}-${diagnostic.spanEnd}px; ` +
        `${diagnostic.classification}`,
      diagnostic,
    }));
  return {
    label,
    width: info.width,
    height: info.height,
    passed: failures.length === 0,
    severity: failures.length > 0
      ? 'error'
      : diagnostics.some(({severity}) => severity === 'warning')
        ? 'warning'
        : 'info',
    diagnostics,
    failures,
  };
};

export const derivationRegionsFromBinding = (binding) => {
  const derivation = binding?.derivation;
  if (!derivation) return [];
  const regions = [];
  if (derivation.placement) {
    regions.push({
      id: `${binding.role ?? 'member'}-placement`,
      kind: 'rectangular-derivation-region',
      rect: derivation.placement,
    });
  }
  if (derivation.clip?.kind === 'rectangle') {
    regions.push({
      id: `${binding.role ?? 'member'}-clip`,
      kind: 'crop-boundary',
      rect: derivation.clip.rect,
    });
  }
  return regions;
};

export const inspectAlphaBands = async ({
  file,
  renderSize = null,
  derivationRegions = [],
  thresholds = DEFAULT_ALPHA_BAND_THRESHOLDS,
}) => {
  const original = await sharp(file)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const sourceSize = {
    width: original.info.width,
    height: original.info.height,
  };
  const scales = [];
  scales.push(analyzeAlphaBandPixels({
    data: original.data,
    info: original.info,
    regions: derivationRegions,
    thresholds,
    label: 'original',
  }));
  if (
    renderSize &&
    Number.isFinite(renderSize.width) &&
    Number.isFinite(renderSize.height)
  ) {
    const target = {
      width: clamp(Math.round(renderSize.width), 1, 8192),
      height: clamp(Math.round(renderSize.height), 1, 8192),
    };
    if (target.width !== sourceSize.width || target.height !== sourceSize.height) {
      const rendered = await sharp(file)
        .toColourspace('srgb')
        .ensureAlpha()
        .resize(target.width, target.height, {fit: 'fill', kernel: 'lanczos3'})
        .raw()
        .toBuffer({resolveWithObject: true});
      scales.push(analyzeAlphaBandPixels({
        data: rendered.data,
        info: rendered.info,
        regions: derivationRegions.map((region) => ({
          ...region,
          rect: scaleRect(region.rect, sourceSize, target),
        })),
        thresholds,
        label: 'render-scale',
      }));
    }
  }
  const failures = scales.flatMap(({label, failures: scaleFailures}) =>
    scaleFailures.map((failure) => ({scale: label, ...failure})),
  );
  return {
    schemaVersion: 1,
    thresholds,
    derivationRegions,
    sourceSize,
    renderSize: scales.find(({label}) => label === 'render-scale')
      ? renderSize
      : null,
    passed: failures.length === 0,
    severity: failures.length > 0
      ? 'error'
      : scales.some(({severity}) => severity === 'warning')
        ? 'warning'
        : 'info',
    scales,
    failures,
    failureMessage: failures.length > 0
      ? failures.map(({message}) => message).join('; ')
      : null,
  };
};

export const alphaBandOverlaySvg = ({inspection, width, height}) => {
  const original =
    inspection.scales.find(({label}) => label === 'original') ??
    inspection.scales[0];
  const lines = (original?.diagnostics ?? []).map((diagnostic) => {
    const color = diagnostic.severity === 'error'
      ? '#ff2d55'
      : diagnostic.severity === 'warning'
        ? '#ff9f0a'
        : '#30d158';
    if (diagnostic.orientation === 'horizontal') {
      return `<rect x="${diagnostic.spanStart}" y="${diagnostic.coordinateStart}" width="${Math.max(1, diagnostic.runPixels)}" height="${Math.max(1, diagnostic.thicknessPixels)}" fill="none" stroke="${color}" stroke-width="3"/>`;
    }
    return `<rect x="${diagnostic.coordinateStart}" y="${diagnostic.spanStart}" width="${Math.max(1, diagnostic.thicknessPixels)}" height="${Math.max(1, diagnostic.runPixels)}" fill="none" stroke="${color}" stroke-width="3"/>`;
  }).join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="none"/>${lines}</svg>`,
  );
};
