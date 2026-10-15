import { startReader } from "./reader-app.mjs?v=flower-15-days";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
