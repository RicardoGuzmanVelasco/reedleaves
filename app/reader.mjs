import { startReader } from "./reader-app.mjs?v=opening-flight-5";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
