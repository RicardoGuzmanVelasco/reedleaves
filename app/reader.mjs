import { startReader } from "./reader-app.mjs?v=currency-recovery-a2-domain-limits-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
