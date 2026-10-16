import { startReader } from "./reader-app.mjs?v=deck-progress-icon";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
