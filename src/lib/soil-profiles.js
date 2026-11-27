/**
 * Configurable CJS loader wrapper for upstream SoilProfiles.js.
 * Resolves `process.env.SOIL_PROFILES_PATH` when set, falling back to the
 * default sibling workspace build at `/home/andrew/workspace/SoilProfiles.js/dist/index.js`.
 */

import { createRequire } from "node:module";

export const DEFAULT_SOIL_PROFILES_PATH =
  process.env.SOIL_PROFILES_PATH ||
  "/home/andrew/workspace/SoilProfiles.js/dist/index.js";

const require = createRequire(import.meta.url);
const soilProfiles = require(DEFAULT_SOIL_PROFILES_PATH);

export const {
  DATA_MAPS,
  SoilProfile,
  SoilProfileCollection,
  mapToHorizon,
  munsellToHex,
  renderStaticSVG,
} = soilProfiles;
