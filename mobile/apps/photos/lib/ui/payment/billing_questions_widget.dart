import 'dart:convert';

import 'package:ente_ui/components/faq/faq_widgets.dart';
import 'package:ente_ui/components/loading_widget.dart';
import 'package:flutter/material.dart';
import 'package:photos/core/network/network.dart';

class BillingQuestionsWidget extends StatefulWidget {
  const BillingQuestionsWidget({super.key});

  @override
  State<BillingQuestionsWidget> createState() => _BillingQuestionsWidgetState();
}

class _BillingQuestionsWidgetState extends State<BillingQuestionsWidget> {
  late final Future<List<FaqItem>> _faqs = _loadFaqs();

  Future<List<FaqItem>> _loadFaqs() async {
    try {
      final response = await NetworkClient.instance.getDio().get(
        "https://biyen.levitation.web.id/faq.json",
      );
      final faqItems = <FaqItem>[];
      if (response.data is List) {
        for (final item in response.data as List) {
          if (item is Map<String, dynamic>) {
            faqItems.add(FaqItem.fromMap(item));
          }
        }
      }
      if (faqItems.isNotEmpty) {
        return faqItems;
      }
    } catch (_) {
      // Fallback to local curated Biyen FAQs
    }
    return _getDefaultFaqs();
  }

  List<FaqItem> _getDefaultFaqs() {
    final isId = mounted && Localizations.localeOf(context).languageCode == 'id';
    if (isId) {
      return [
        FaqItem(
          q: "Bagaimana cara kerja penyimpanan terenkripsi Biyen?",
          a: "Biyen menerapkan enkripsi end-to-end secara default. Seluruh foto dan video Anda dienkripsi di perangkat sebelum dikirim ke server, sehingga hanya Anda yang memegang kunci enkripsinya.",
        ),
        FaqItem(
          q: "Apakah saya bisa membatalkan atau mengubah paket kapan saja?",
          a: "Tentu. Anda dapat meningkatkan, menurunkan, atau membatalkan paket langganan kapan saja dari halaman Pengaturan Akun tanpa komitmen jangka panjang.",
        ),
        FaqItem(
          q: "Apakah foto dan video dikompres?",
          a: "Tidak. Biyen menyimpan file Anda dalam kualitas asli dan resolusi penuh tanpa kompresi atau degradasi kualitas.",
        ),
        FaqItem(
          q: "Bagaimana cara kerja Paket Keluarga?",
          a: "Dengan paket keluarga, Anda dapat berbagi kapasitas penyimpanan dengan anggota keluarga lainnya. Data dan foto setiap anggota tetap sepenuhnya privat dan tidak dapat diakses satu sama lain.",
        ),
      ];
    } else {
      return [
        FaqItem(
          q: "How does Biyen's encrypted storage work?",
          a: "Biyen applies end-to-end encryption by default. All your photos and videos are encrypted on your device before uploading to our servers, ensuring only you hold the keys.",
        ),
        FaqItem(
          q: "Can I cancel or change my plan anytime?",
          a: "Yes. You can upgrade, downgrade, or cancel your subscription plan at any time through your account settings without long-term commitments.",
        ),
        FaqItem(
          q: "Are my photos or videos compressed?",
          a: "No. Biyen preserves all your media in original, full resolution without compression or loss of quality.",
        ),
        FaqItem(
          q: "How does the Family Plan work?",
          a: "With a family plan, you can share storage space with your family members. Everyone's photos and data remain strictly private and inaccessible to others.",
        ),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<FaqItem>>(
      future: _faqs,
      builder: (BuildContext context, AsyncSnapshot<List<FaqItem>> snapshot) {
        final faqs = snapshot.data;
        if (faqs == null) {
          return const EnteLoadingWidget();
        }
        return FaqSection(
          children: [
            for (final faq in faqs)
              FaqItemWidget(question: faq.q ?? '', answer: faq.a ?? ''),
          ],
        );
      },
    );
  }
}

class FaqItem {
  final String? q;
  final String? a;
  FaqItem({this.q, this.a});

  FaqItem copyWith({String? q, String? a}) {
    return FaqItem(q: q ?? this.q, a: a ?? this.a);
  }

  Map<String, dynamic> toMap() {
    return {'q': q, 'a': a};
  }

  factory FaqItem.fromMap(Map<String, dynamic> map) {
    return FaqItem(
      q: map['q']?.toString() ?? '',
      a: map['a']?.toString() ?? '',
    );
  }

  String toJson() => json.encode(toMap());

  factory FaqItem.fromJson(String source) =>
      FaqItem.fromMap(json.decode(source));

  @override
  String toString() => 'FaqItem(q: $q, a: $a)';

  @override
  bool operator ==(Object o) {
    if (identical(this, o)) return true;

    return o is FaqItem && o.q == q && o.a == a;
  }

  @override
  int get hashCode => q.hashCode ^ a.hashCode;
}
