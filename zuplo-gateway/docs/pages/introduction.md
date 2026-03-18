---
title: Introduction
description: Restormel Keys Cloud API — gateway and developer portal.
---

# Introduction

**You are in the API portal** (Gateway reference and Try it). To leave this site: use the **On restormel.dev** tab in the nav for **Keys**, **Documentation**, or **Dashboard** — or click the Restormel logo to return to the product home.

The Restormel Keys API has two distinct surfaces. Use the right one for your task.

## Gateway API (this portal)

**Base URL**: `https://restormel-keys-gateway-main-bc13eba.zuplo.app`  
**Auth**: Consumer key (`zpka_...`) — [get yours here](/my-keys)  
**Use for**: Project management and Gateway key CRUD (control-plane)

## Dashboard API

**Base URL**: `https://restormel.dev/keys/dashboard/api`  
**Auth**: Gateway Key (`rk_...`) — created in the [Restormel dashboard](https://restormel.dev/keys/dashboard)  
**Use for**: Resolve, policy evaluate, route steps (runtime operations)

> Not sure which to use? If you're integrating Restormel Keys into your app, you almost certainly want the **Dashboard API**. See [Dashboard API Overview](/dashboard-api/overview).

## Authentication

Sign in with GitHub to use "Try it" in the Gateway API Reference and to retrieve your consumer key.  
[Sign in →](/oauth/login)

