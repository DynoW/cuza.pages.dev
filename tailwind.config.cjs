/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				'sans': ['Inter', ...defaultTheme.fontFamily.sans],
				'serif': ['Poppins', ...defaultTheme.fontFamily.sans],
			},
			screens: {
				'xxs': '320px',
				'xs': '400px',
			}
		},
	},
	plugins: [],
}
