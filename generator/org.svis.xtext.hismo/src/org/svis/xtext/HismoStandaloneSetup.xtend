/*
 * generated by Xtext 2.9.0
 */
package org.svis.xtext


/**
 * Initialization support for running Xtext languages without Equinox extension registry.
 */
class HismoStandaloneSetup extends HismoStandaloneSetupGenerated {

	def static void doSetup() {
		new HismoStandaloneSetup().createInjectorAndDoEMFRegistration()
	}
}
