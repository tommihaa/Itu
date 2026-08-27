// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import "./styles.css";
import { mountGame } from "./ui/game";

const app = document.querySelector<HTMLElement>("#app")!;
mountGame(app);
