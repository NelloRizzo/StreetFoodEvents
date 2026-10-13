package com.streetfoodevents.customer.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelTests {

    @Test
    fun testLocationDtoToReadableString() {
        val location = LocationDto(
            address = "Piazza Garibaldi 1",
            city = "Napoli",
            province = "NA"
        )
        assertEquals("Piazza Garibaldi 1, Napoli, NA", location.toReadableString())

        val emptyLocation = LocationDto()
        assertEquals("Luogo da definire", emptyLocation.toReadableString())
    }

    @Test
    fun testOrderTrackDtoStatusLabels() {
        val pendingOrder = OrderTrackDto(id = "1", orderNumber = 10, status = "pending")
        assertEquals("In attesa", pendingOrder.getStatusLabel())

        val preparingOrder = OrderTrackDto(id = "2", orderNumber = 11, status = "preparing")
        assertEquals("In preparazione", preparingOrder.getStatusLabel())

        val readyOrder = OrderTrackDto(id = "3", orderNumber = 12, status = "ready")
        assertEquals("Pronto per il ritiro!", readyOrder.getStatusLabel())

        val deliveredOrder = OrderTrackDto(id = "4", orderNumber = 13, status = "delivered")
        assertEquals("Ritirato / Consegnato", deliveredOrder.getStatusLabel())

        val cancelledOrder = OrderTrackDto(id = "5", orderNumber = 14, status = "cancelled")
        assertEquals("Annullato", cancelledOrder.getStatusLabel())
    }

    @Test
    fun testTransactionDtoIsTopUp() {
        val topUpTx = TransactionDto(
            id = "t1",
            eventUserId = "u1",
            type = "top-up",
            direction = "in",
            amount = 20.0
        )
        assertTrue(topUpTx.isTopUp())

        val paymentTx = TransactionDto(
            id = "t2",
            eventUserId = "u1",
            type = "payment",
            direction = "out",
            amount = 10.0
        )
        assertFalse(paymentTx.isTopUp())
    }

    @Test
    fun testImageDtoGetBestUrl() {
        val secureImage = ImageDto(url = "http://example.com/pic.jpg", secureUrl = "https://example.com/pic.jpg")
        assertEquals("https://example.com/pic.jpg", secureImage.getBestUrl())

        val plainImage = ImageDto(url = "http://example.com/pic.jpg", secureUrl = null)
        assertEquals("http://example.com/pic.jpg", plainImage.getBestUrl())
    }
}
