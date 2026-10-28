import { startReader } from "./reader-app.mjs?v=library-interest-sort-login-15";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
