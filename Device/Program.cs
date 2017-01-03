using System;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Azure.Devices.Client;
using Newtonsoft.Json;
using System.Diagnostics;
using System.Configuration;


namespace IoTWrite
{
    /**
     * Azure IoT SDK
     */
    class Program
    {
        static DeviceClient deviceClient;
        static string deviceKey;
        static string iotHubUri;
        static private PerformanceCounter cpuCounter = new PerformanceCounter();

        static void Main(string[] args)
        {
            deviceKey = ConfigurationManager.AppSettings["iotDeviceKey"];
            iotHubUri = ConfigurationManager.AppSettings["iotHubUri"];
            // init counters
            cpuCounter.CategoryName = "Processor";
            cpuCounter.CounterName = "% Processor Time";
            cpuCounter.InstanceName = "_Total";

            Console.WriteLine("Simulated device\n");
            deviceClient = DeviceClient.Create(iotHubUri, new DeviceAuthenticationWithRegistrySymmetricKey("myFirstDevice", deviceKey), TransportType.Mqtt);
            SendDeviceToCloudMessagesAsync();
            ReceiveC2dAsync();
            Console.ReadLine();
        }

        /**
         * Receive Cloud to Device messages (i.e. config changes/controls)
         */
        private static async void ReceiveC2dAsync()
        {
            Console.WriteLine("\nReceiving cloud to device messages from service");
            while (true)
            {
                Message receivedMessage = await deviceClient.ReceiveAsync();
                if (receivedMessage == null)
                    continue;

                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("Received message: {0}", Encoding.ASCII.GetString(receivedMessage.GetBytes()));
                Console.ResetColor();

                await deviceClient.CompleteAsync(receivedMessage);
            }
        }

        /**
         * Push Device to Cloud (status) messages
         */
        private static async void SendDeviceToCloudMessagesAsync()
        {
            while (true)
            {
                var deviceData = new
                {
                    deviceId = "myFirstDevice",
                    cpu = Math.Round(cpuCounter.NextValue(), 1)
                };
                string messageString = JsonConvert.SerializeObject(deviceData);
                Message message = new Message(Encoding.ASCII.GetBytes(messageString));

                await deviceClient.SendEventAsync(message);
                Console.WriteLine("{0} > Sending message: {1}", DateTime.Now, messageString);

                Task.Delay(10000).Wait();
            }
        }
    }
}
