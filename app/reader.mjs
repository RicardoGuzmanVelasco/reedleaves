import { startReader } from "./reader-app.mjs?v=initial-interest-gate-22c-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
