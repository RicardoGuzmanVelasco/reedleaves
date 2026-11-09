import { startReader } from "./reader-app.mjs?v=soil-bud-3";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
