import { startReader } from "./reader-app.mjs?v=practice-touch-polish";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
