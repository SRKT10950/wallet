class Invoice {
  final String id;
  final String invoiceNumber;
  final String invoiceDate;
  final String? customerName;
  final double grandTotal;
  final double amountPaid;
  final double balanceDue;
  final String paymentStatus;

  Invoice({
    required this.id,
    required this.invoiceNumber,
    required this.invoiceDate,
    this.customerName,
    required this.grandTotal,
    required this.amountPaid,
    required this.balanceDue,
    required this.paymentStatus,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] ?? '',
      invoiceNumber: json['invoice_number'] ?? '',
      invoiceDate: json['invoice_date'] ?? '',
      customerName: json['customer_name'],
      grandTotal: (json['grand_total'] is num) ? (json['grand_total'] as num).toDouble() : double.tryParse(json['grand_total'].toString()) ?? 0.0,
      amountPaid: (json['amount_paid'] is num) ? (json['amount_paid'] as num).toDouble() : double.tryParse(json['amount_paid'].toString()) ?? 0.0,
      balanceDue: (json['balance_due'] is num) ? (json['balance_due'] as num).toDouble() : double.tryParse(json['balance_due'].toString()) ?? 0.0,
      paymentStatus: json['payment_status'] ?? 'UNPAID',
    );
  }
}

class Expense {
  final String id;
  final String categoryName;
  final String description;
  final double amount;
  final String expenseDate;
  final String paymentMethod;

  Expense({
    required this.id,
    required this.categoryName,
    required this.description,
    required this.amount,
    required this.expenseDate,
    required this.paymentMethod,
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id'] ?? '',
      categoryName: json['category_name'] ?? 'General',
      description: json['description'] ?? '',
      amount: (json['amount'] is num) ? (json['amount'] as num).toDouble() : double.tryParse(json['amount'].toString()) ?? 0.0,
      expenseDate: json['expense_date'] ?? '',
      paymentMethod: json['payment_method'] ?? 'CASH',
    );
  }
}

class Customer {
  final String id;
  final String name;
  final String? phone;
  final double outstandingBalance;

  Customer({
    required this.id,
    required this.name,
    this.phone,
    required this.outstandingBalance,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'],
      outstandingBalance: (json['outstanding_balance'] is num)
          ? (json['outstanding_balance'] as num).toDouble()
          : double.tryParse(json['outstanding_balance'].toString()) ?? 0.0,
    );
  }
}
