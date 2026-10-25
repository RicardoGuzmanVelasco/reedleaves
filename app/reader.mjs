import { startReader } from "./reader-app.mjs?v=daily-calendar-open-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
