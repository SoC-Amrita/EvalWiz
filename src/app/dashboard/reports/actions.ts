"use server"

import { getReportsDetailData } from "./data"

export async function loadReportsDetailData() {
  return getReportsDetailData()
}
