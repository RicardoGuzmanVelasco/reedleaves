import { startReader } from "./reader-app.mjs?v=practice-card-back-2";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
