import { startReader } from "./reader-app.mjs?v=practice-shuffle-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
