import type { Request,Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { analyticsService } from '../services/analyticsService.js';

export type AnalyticsService=typeof analyticsService;
export function createAnalyticsController(service:AnalyticsService=analyticsService){return{async overview(_request:Request,response:Response){try{response.json({data:await service.getAnalytics()});}catch(error){if(error instanceof ApiError){response.status(error.status).json({error:{code:error.code,message:error.message}});return;}console.error('Analytics request failed:',error);response.status(500).json({error:{code:'ANALYTICS_FAILED',message:'Unable to load analytics.'}});}}};}
