import { startReader } from "./reader-app.mjs?v=domain-limits-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
