import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const stopCode = params.stopCode;
	const API_KEY = '0be8ebd0284ce712a63f29dcaf7798c4';
	const API_URL = `https://webservices.umoiq.com/api/pub/v1/agencies/sfmta-cis/stopcodes/${stopCode}/predictions?key=${API_KEY}`;

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