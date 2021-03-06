package org.svis.generator.tests.rd.hismo

import static org.junit.Assert.*
import org.junit.Test
import org.junit.BeforeClass
import java.io.File
import java.io.FileNotFoundException
import org.eclipse.emf.mwe2.launch.runtime.Mwe2Launcher
import org.apache.commons.io.FileUtils

class Sidekiq_TimeLineX3DTest {
		//TODO reimplement tests for new hismo metamodel
	@BeforeClass
	def static void launch() {
		new Mwe2Launcher().run(#["../org.svis.generator.run/src/org/svis/generator/run/rd/Hismo2RD.mwe2", "-p", "inputPath=testdata/sidekiq/input","outputPath=output/rd/hismo/sidekiq/sidekiq_x3d_time_line/"])
	}
     
    @Test
    def testX3D() {
    	var File file1 = null
        var File file2 = null
        try {
            file1 = new File("./output/rd/hismo/sidekiq/sidekiq_x3d_time_line/model.x3d")
			file2 = new File("./testdata/sidekiq/output/rd/hismo/sidekiq_x3d_time_line/model.x3d")
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
			file1 = new File("./testdata/sidekiq/output/rd/hismo/sidekiq_x3d_time_line/rd.xml")
			file2 = new File("./output/rd/hismo/sidekiq/sidekiq_x3d_time_line/rd.xml")
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
            file1 = new File("./output/rd/hismo/sidekiq/sidekiq_x3d_time_line/metaData.json")
			file2 = new File("./testdata/sidekiq/output/rd/hismo/sidekiq_x3d_time_line/metaData.json")
        } catch (FileNotFoundException e) {
            e.printStackTrace
        }
        
		assertEquals(FileUtils.checksumCRC32(file1), FileUtils.checksumCRC32(file2))
	}
	
	
}