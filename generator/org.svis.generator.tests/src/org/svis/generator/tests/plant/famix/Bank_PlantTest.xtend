package org.svis.generator.tests.plant.famix

import static org.junit.Assert.*
import org.junit.Test
import org.junit.BeforeClass
import org.custommonkey.xmlunit.XMLUnit
import java.io.File
import java.io.FileNotFoundException
import org.eclipse.emf.mwe2.launch.runtime.Mwe2Launcher
import org.apache.commons.io.FileUtils

class Bank_PlantTest {
	
	val static path = "./output/plant/famix/bank/"
	
	@BeforeClass
	def static void launch() {
		XMLUnit::ignoreWhitespace = true
		XMLUnit::ignoreComments = true
		new Mwe2Launcher().run(#["../org.svis.generator.run/src/org/svis/generator/run/plant/Famix2Plant.mwe2", "-p", "path=testdata/bank/input/famix", "outputPath=" + path,
			"configPath=testdata/bank/input/famix/plantConfig.json","projectName=org.svis.generator.tests","texturDestinyPath=org.svis.generator.tests/output/plant/famix/bank/pics"])
	}
	
	@Test
    def testX3D() {
    	var File file1 = null
        var File file2 = null
        try {
            file1 = new File(path + "model.x3d")
			file2 = new File("./testdata/bank/output/plant/famix/model.x3d")
        } catch (FileNotFoundException e) {
            e.printStackTrace
        }

        assertEquals(FileUtils.checksumCRC32(file1), FileUtils.checksumCRC32(file2))
    }
    
    @Test
	def testMetaData() {
		var File file1 = null
		var File file2 = null
		try {
			file1 = new File( path + "metaData.json")
			file2 = new File("./testdata/bank/output/plant/famix/metaData.json")
		} catch (FileNotFoundException e) {
			e.printStackTrace
		}
        
		assertEquals(FileUtils.checksumCRC32(file1), FileUtils.checksumCRC32(file2))
	}
	
	    
    @Test
    def rd() {
    	var File file1 = null
    	var File file2 = null
        try {
			file1 = new File("./testdata/bank/output/plant/famix/plant.xml")
			file2 = new File(path + "plant.xml")
        } catch (FileNotFoundException e) {
            e.printStackTrace
        }
        
    	assertEquals(FileUtils.checksumCRC32(file1), FileUtils.checksumCRC32(file2))
    }
    
    @Test
    def rdExtended() {
    	var File file1 = null
    	var File file2 = null

        try {
			file1 = new File("./testdata/bank/output/plant/famix/plantextended.xml")
			file2 = new File(path + "plantextended.xml")
        } catch (FileNotFoundException e) {
            e.printStackTrace
        }
    	
    	assertEquals(FileUtils.checksumCRC32(file1), FileUtils.checksumCRC32(file2))
    }
	
}