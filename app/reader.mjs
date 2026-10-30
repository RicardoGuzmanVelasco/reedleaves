import { startReader } from "./reader-app.mjs?v=reading-guide-write-prompt-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
