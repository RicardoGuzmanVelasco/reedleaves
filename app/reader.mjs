import { startReader } from "./reader-app.mjs?v=bottom-navigation-icons-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
