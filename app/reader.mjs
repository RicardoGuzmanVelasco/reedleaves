import { startReader } from "./reader-app.mjs?v=evergreen-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
