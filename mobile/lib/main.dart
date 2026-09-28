import 'package:flutter/material.dart';
import 'core/device_identity.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DeviceIdentity.initialize();

  final token = await DeviceIdentity.getAuthToken();
  final isEnrolled = await DeviceIdentity.isEnrolled();

  runApp(MyWalletApp(
    initialScreen: (token != null && isEnrolled)
        ? const DashboardScreen()
        : const LoginScreen(),
  ));
}

class MyWalletApp extends StatelessWidget {
  final Widget initialScreen;

  const MyWalletApp({super.key, required this.initialScreen});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My Wallet',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF16A34A),
          primary: const Color(0xFF16A34A),
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        fontFamily: 'Roboto',
      ),
      home: initialScreen,
    );
  }
}
