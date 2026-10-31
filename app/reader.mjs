import { startReader } from "./reader-app.mjs?v=opening-flight-11";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
