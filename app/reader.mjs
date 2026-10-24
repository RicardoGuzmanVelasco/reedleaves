import { startReader } from "./reader-app.mjs?v=reading-guides-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
