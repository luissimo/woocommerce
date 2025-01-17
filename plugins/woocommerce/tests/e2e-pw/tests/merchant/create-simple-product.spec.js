const { test, expect } = require( '@playwright/test' );
const wcApi = require( '@woocommerce/woocommerce-rest-api' ).default;

const virtualProductName = 'Virtual Product Name';
const nonVirtualProductName = 'Non Virtual Product Name';
const productPrice = '9.99';
let shippingZoneId, virtualProductPermalink, nonVirtualProductPermalink;

test.describe( 'Add New Simple Product Page', () => {
	test.use( { storageState: process.env.ADMINSTATE } );

	test.beforeAll( async ( { baseURL } ) => {
		// need to add a shipping zone
		const api = new wcApi( {
			url: baseURL,
			consumerKey: process.env.CONSUMER_KEY,
			consumerSecret: process.env.CONSUMER_SECRET,
			version: 'wc/v3',
		} );
		// and the flat rate shipping method to that zone
		await api
			.post( 'shipping/zones', {
				name: 'Somewhere',
			} )
			.then( ( response ) => {
				shippingZoneId = response.data.id;
				api.put( `shipping/zones/${ shippingZoneId }/locations`, [
					{ code: 'CN' },
				] );
				api.post( `shipping/zones/${ shippingZoneId }/methods`, {
					method_id: 'flat_rate',
				} );
			} );
	} );

	test.afterAll( async ( { baseURL } ) => {
		// cleans up all products after run
		const api = new wcApi( {
			url: baseURL,
			consumerKey: process.env.CONSUMER_KEY,
			consumerSecret: process.env.CONSUMER_SECRET,
			version: 'wc/v3',
		} );
		await api.get( 'products' ).then( ( response ) => {
			const products = response.data;
			for ( const product of products ) {
				if (
					product.name === virtualProductName ||
					product.name === nonVirtualProductName
				) {
					api.delete( `products/${ product.id }`, {
						force: true,
					} ).then( () => {
						// nothing to do here.
					} );
				}
			}
		} );
		// delete the shipping zone
		await api.delete( `shipping/zones/${ shippingZoneId }`, {
			force: true,
		} );
	} );

	test( 'can create simple virtual product', async ( { page } ) => {
		await page.goto( 'wp-admin/post-new.php?post_type=product' );
		await page.fill( '#title', virtualProductName );
		await page.fill( '#_regular_price', productPrice );
		await page.click( '#_virtual' );
		await page.click( '#publish' );
		await page.waitForLoadState( 'networkidle' );

		// When running in parallel, clicking the publish button sometimes saves products as a draft
		if (
			( await page.innerText( '#post-status-display' ) ).includes(
				'Draft'
			)
		) {
			await page.click( '#publish' );
			await page.waitForLoadState( 'networkidle' );
		}

		await expect( page.locator( 'div.notice-success > p' ) ).toContainText(
			'Product published.'
		);

		virtualProductPermalink = await page
			.locator( '#sample-permalink a' )
			.getAttribute( 'href' );
	} );

	test( 'can have a shopper add the simple virtual product to the cart', async ( {
		page,
	} ) => {
		await page.goto( virtualProductPermalink );
		await expect( page.locator( '.product_title' ) ).toHaveText(
			virtualProductName
		);
		await expect(
			page.locator( '.summary .woocommerce-Price-amount' )
		).toContainText( productPrice );
		await page.click( 'text=Add to cart' );
		await page.click( 'text=View cart' );
		await expect( page.locator( 'td[data-title=Product]' ) ).toContainText(
			virtualProductName
		);
		await expect(
			page.locator( 'a.shipping-calculator-button' )
		).not.toBeVisible();
		await page.click( 'a.remove' );
	} );

	test( 'can create simple non-virtual product', async ( { page } ) => {
		await page.goto( 'wp-admin/post-new.php?post_type=product' );
		await page.fill( '#title', nonVirtualProductName );
		await page.fill( '#_regular_price', productPrice );
		await expect( page.locator( '#publish:not(.disabled)' ) ).toBeVisible();
		await page.click( '#publish' );
		await page.waitForLoadState( 'networkidle' );

		// When running in parallel, clicking the publish button sometimes saves products as a draft
		if (
			( await page.innerText( '#post-status-display' ) ).includes(
				'Draft'
			)
		) {
			await page.click( '#publish' );
			await page.waitForLoadState( 'networkidle' );
		}

		await expect( page.locator( 'div.notice-success > p' ) ).toContainText(
			'Product published.'
		);

		nonVirtualProductPermalink = await page
			.locator( '#sample-permalink a' )
			.getAttribute( 'href' );
	} );

	test( 'can have a shopper add the simple non-virtual product to the cart', async ( {
		page,
	} ) => {
		await page.goto( nonVirtualProductPermalink );
		await expect( page.locator( '.product_title' ) ).toHaveText(
			nonVirtualProductName
		);
		await expect(
			page.locator( '.summary .woocommerce-Price-amount' )
		).toContainText( productPrice );
		await page.click( 'text=Add to cart' );
		await page.click( 'text=View cart' );
		await expect( page.locator( 'td[data-title=Product]' ) ).toContainText(
			nonVirtualProductName
		);
		await expect(
			page.locator( 'a.shipping-calculator-button' )
		).toBeVisible();
		await page.click( 'a.remove' );
	} );
} );
