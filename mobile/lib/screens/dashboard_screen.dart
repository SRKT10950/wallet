import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/device_identity.dart';
import 'invoices_screen.dart';
import 'expenses_screen.dart';
import 'customers_screen.dart';
import 'device_info_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _summary;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() => _isLoading = true);
    try {
      final data = await ApiClient.get('/dashboard/summary');
      setState(() {
        _summary = data;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleLogout() async {
    await DeviceIdentity.clearAuthToken();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = _summary?['today'] ?? {};
    final invoices = _summary?['invoices'] ?? {};

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'My Wallet',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: _loadDashboard,
          ),
          IconButton(
            icon: const Icon(Icons.info_outline, size: 20),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const DeviceInfoScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadDashboard,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header greeting
                    Text(
                      'Store Dashboard',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF0F172A),
                          ),
                    ),
                    const Text(
                      'Today\'s business performance summary',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 16),

                    // Metrics Grid
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard(
                            'Today\'s Sales',
                            '\$${(today['sales'] ?? 0).toStringAsFixed(2)}',
                            Icons.trending_up,
                            const Color(0xFF16A34A),
                            const Color(0xFFF0FDF4),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildMetricCard(
                            'Today\'s Expenses',
                            '\$${(today['expenses'] ?? 0).toStringAsFixed(2)}',
                            Icons.trending_down,
                            const Color(0xFFDC2626),
                            const Color(0xFFFEF2F2),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard(
                            'Estimated Profit',
                            '\$${(today['estimatedProfit'] ?? 0).toStringAsFixed(2)}',
                            Icons.attach_money,
                            const Color(0xFF2563EB),
                            const Color(0xFFEFF6FF),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildMetricCard(
                            'Total Due',
                            '\$${(invoices['totalOutstanding'] ?? 0).toStringAsFixed(2)}',
                            Icons.access_time,
                            const Color(0xFFD97706),
                            const Color(0xFFFFFBEB),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Navigation actions
                    const Text(
                      'Quick Actions',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 12),

                    _buildActionTile(
                      'Invoices & Billing',
                      'Create and view customer sales invoices',
                      Icons.receipt_long,
                      () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InvoicesScreen())),
                    ),
                    const SizedBox(height: 8),
                    _buildActionTile(
                      'Expense Tracker',
                      'Record daily operational shop expenses',
                      Icons.arrow_downward,
                      () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ExpensesScreen())),
                    ),
                    const SizedBox(height: 8),
                    _buildActionTile(
                      'Customer Accounts',
                      'Manage customer directory and balances',
                      Icons.people_outline,
                      () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomersScreen())),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color, Color bgColor) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: color, size: 16),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(String title, String subtitle, IconData icon, VoidCallback onTap) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: const Color(0xFF16A34A), size: 20),
        ),
        title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        trailing: const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
        onTap: onTap,
      ),
    );
  }
}
