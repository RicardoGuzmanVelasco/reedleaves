import { startReader } from "./reader-app.mjs?v=scroll-navigation-3";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
