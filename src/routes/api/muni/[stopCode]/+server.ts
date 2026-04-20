import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const stopCode = params.stopCode;
	const apiKey = process.env.UMO_IQ_API_KEY;
	if (!apiKey) {
		console.error('UMO_IQ_API_KEY is not set');
		return json({ error: 'Server configuration error' }, { status: 500 });
	}
	const API_URL = `https://webservices.umoiq.com/api/pub/v1/agencies/sfmta-cis/stopcodes/${stopCode}/predictions?key=${apiKey}`;

	try {
		const response = await fetch(API_URL);
		
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error fetching MUNI data:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
}; 