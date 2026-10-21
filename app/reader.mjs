import { startReader } from "./reader-app.mjs?v=compact-navigation-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
