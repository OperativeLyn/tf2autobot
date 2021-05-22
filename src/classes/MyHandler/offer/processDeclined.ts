import * as i from '@tf2autobot/tradeoffer-manager';
import SKU from 'tf2-sku-2';
import Bot from '../../Bot';
import * as t from '../../../lib/tools/export';
import sendTradeDeclined from '../../../lib/DiscordWebhook/sendTradeDeclined';
import { KeyPrices } from '../../../classes/Pricelist';
import Autokeys, { OverallStatus } from '../../../classes/Autokeys/Autokeys';
import { TradeSummary } from '../../Options';

export default function processDeclined(offer: i.TradeOffer, bot: Bot, isTradingKeys: boolean): void {
    const opt = bot.options;

    const declined: Declined = {
        //nonTf2Items: [],
        highNotSellingItems: [],
        overstocked: [],
        understocked: [],
        invalidItems: [],
        disabledItems: [],
        dupedItems: [],
        reasonDescription: ''
    };

    const offerReceived = offer.data('action') as i.Action;
    const meta = offer.data('meta') as i.Meta;

    const isWebhookEnabled = opt.discordWebhook.declinedTrade.enable && opt.discordWebhook.declinedTrade.url.length > 0;

    if (offerReceived) {
        switch (offerReceived.reason) {
            case 'ESCROW':
                declined.reasonDescription = offerReceived.reason + ': Partner has trade hold.';
                break;
            case 'BANNED':
                declined.reasonDescription = offerReceived.reason + ': Partner is banned in one or more communities.';
                break;
            case '🟨_CONTAINS_NON_TF2':
                declined.reasonDescription = offerReceived.reason + ': Trade includes non-TF2 items.';
                //Maybe implement tags for them as well ?
                break;
            case 'GIFT_NO_NOTE':
                declined.reasonDescription = offerReceived.reason + ': We dont accept gift without gift messages.';
                break;
            case 'CRIME_ATTEMPT':
                declined.reasonDescription = offerReceived.reason + ': Tried to take our items for free.';
                break;
            case 'OVERPAY':
                declined.reasonDescription = offerReceived.reason + ': We are not accepting overpay.';
                break;
            case 'DUELING_NOT_5_USES':
                declined.reasonDescription = offerReceived.reason + ': We only accept 5 use Dueling Mini-Games.';
                break;
            case 'NOISE_MAKER_NOT_25_USES':
                declined.reasonDescription = offerReceived.reason + ': We only accept 25 use Noise Makers.';
                break;
            case 'HIGH_VALUE_ITEMS_NOT_SELLING':
                declined.reasonDescription =
                    offerReceived.reason + ': Tried to take our high value items that we are not selling.';
                //check our items to add tag
                declined.highNotSellingItems.push(...meta.highValueName);
                break;
            case 'ONLY_METAL':
                declined.reasonDescription = offerReceived.reason + ': Offer contains only metal.';
                break;
            case 'NOT_TRADING_KEYS':
                declined.reasonDescription = offerReceived.reason + ': We are not trading keys.';
                break;
            case 'NOT_SELLING_KEYS':
                declined.reasonDescription = offerReceived.reason + ': We are not selling keys.';
                break;
            case 'NOT_BUYING_KEYS':
                declined.reasonDescription = offerReceived.reason + ': We are not buying keys.';
                break;
            case '🟥_INVALID_VALUE':
                declined.reasonDescription = offerReceived.reason + ': We are paying more than them.';
                break;
            case '🟫_DUPED_ITEMS':
                declined.reasonDescription = offerReceived.reason + ': Offer contains duped items.';
                break;
            case '🟦_OVERSTOCKED':
                declined.reasonDescription =
                    offerReceived.reason + ": Offer contains items that'll make us overstocked.";
                break;
            case '🟩_UNDERSTOCKED':
                declined.reasonDescription =
                    offerReceived.reason + ": Offer contains items that'll make us understocked.";
                break;
            case 'ONLY_INVALID_VALUE':
            case 'ONLY_INVALID_ITEMS':
            case 'ONLY_DISABLED_ITEMS':
            case 'ONLY_OVERSTOCKED':
            case 'ONLY_UNDERSTOCKED':
                //It was probably faster to make them by hand but :/
                declined.reasonDescription =
                    offerReceived.reason +
                    ': We are auto declining ' +
                    offerReceived.reason
                        .split('_')
                        .slice(1)
                        .join(' ')
                        .toLowerCase()
                        .replace(/(\b(?! ).)/g, char => char.toUpperCase());
                break;
        }
        const checkedReasons = {};
        meta?.uniqueReasons?.forEach(reason => {
            if (checkedReasons[reason]) return;
            checkedReasons[reason] = '.';
            switch (reason) {
                case '🟨_INVALID_ITEMS':
                    (meta.reasons.filter(el => el.reason === '🟨_INVALID_ITEMS') as i.InvalidItems[]).forEach(el => {
                        const name = t.testSKU(el.sku) ? bot.schema.getName(SKU.fromString(el.sku), false) : el.sku;

                        declined.invalidItems.push(`${isWebhookEnabled ? `_${name}_` : name} - ${el.price}`);
                    });
                    break;
                case '🟧_DISABLED_ITEMS':
                    (meta.reasons.filter(el => el.reason == '🟧_DISABLED_ITEMS') as i.DisabledItems[]).forEach(el => {
                        declined.disabledItems.push(
                            isWebhookEnabled
                                ? `_${bot.schema.getName(SKU.fromString(el.sku), false)}_`
                                : bot.schema.getName(SKU.fromString(el.sku), false)
                        );
                    });
                    break;
                case '🟦_OVERSTOCKED':
                    (meta.reasons.filter(el => el.reason.includes('🟦_OVERSTOCKED')) as i.Overstocked[]).forEach(el => {
                        declined.overstocked.push(
                            `${
                                isWebhookEnabled
                                    ? `_${bot.schema.getName(SKU.fromString(el.sku), false)}_`
                                    : bot.schema.getName(SKU.fromString(el.sku), false)
                            } (amount can buy was ${el.amountCanTrade}, offered ${el.amountOffered})`
                        );
                    });
                    break;
                case '🟩_UNDERSTOCKED':
                    (meta.reasons.filter(el => el.reason.includes('🟩_UNDERSTOCKED')) as i.Understocked[]).forEach(
                        el => {
                            declined.understocked.push(
                                `${
                                    isWebhookEnabled
                                        ? `_${bot.schema.getName(SKU.fromString(el.sku), false)}_`
                                        : bot.schema.getName(SKU.fromString(el.sku), false)
                                } (amount can sell was ${el.amountCanTrade}, taken ${el.amountTaking})`
                            );
                        }
                    );
                    break;
                case '🟫_DUPED_ITEMS':
                    (meta.reasons.filter(el => el.reason.includes('🟫_DUPED_ITEMS')) as i.DupedItems[]).forEach(el => {
                        declined.dupedItems.push(
                            isWebhookEnabled
                                ? `_${bot.schema.getName(SKU.fromString(el.sku))}_`
                                : bot.schema.getName(SKU.fromString(el.sku))
                        );
                    });
                    break;
            }
        });
    }

    const isOfferSent = offer.data('action') === undefined;
    const timeTakenToProcessOrConstruct = (offer.data('constructOfferTime') ||
        offer.data('processOfferTime')) as number;

    if (isWebhookEnabled) {
        void sendTradeDeclined(offer, declined, bot, timeTakenToProcessOrConstruct, isTradingKeys, isOfferSent);
    } else {
        const slots = bot.tf2.backpackSlots;
        const itemsName = {
            invalid: declined.invalidItems, // 🟨_INVALID_ITEMS
            disabled: declined.disabledItems, // 🟧_DISABLED_ITEMS
            overstock: declined.overstocked, // 🟦_OVERSTOCKED
            understock: declined.understocked, // 🟩_UNDERSTOCKED
            duped: declined.dupedItems, // '🟫_DUPED_ITEMS'
            dupedFailed: [],
            highValue: declined.highNotSellingItems
        };
        const keyPrices = bot.pricelist.getKeyPrices;
        const value = t.valueDiff(offer, keyPrices, isTradingKeys, opt.miscSettings.showOnlyMetal.enable);
        const itemList = t.listItems(offer, bot, itemsName, true);

        const autokeys = bot.handler.autokeys;
        const status = autokeys.getOverallStatus;

        const tDec = bot.options.tradeSummary;
        const cT = tDec.customText;
        const cTKeyRate = cT.keyRate.steamChat ? cT.keyRate.steamChat : '🔑 Key rate:';
        const cTPureStock = cT.pureStock.steamChat ? cT.pureStock.steamChat : '💰 Pure stock:';
        const cTTotalItems = cT.totalItems.steamChat ? cT.totalItems.steamChat : '🎒 Total items:';
        const cTTimeTaken = cT.timeTaken.steamChat ? cT.timeTaken.steamChat : '⏱ Time taken:';

        const customInitializer = bot.options.steamChat.customInitializer.declinedTradeSummary;
        const isCustomPricer = bot.pricelist.isUseCustomPricer;

        sendToAdmin(
            bot,
            offer,
            customInitializer,
            value,
            itemList,
            keyPrices,
            isOfferSent,
            isCustomPricer,
            cTKeyRate,
            autokeys,
            status,
            slots,
            cTPureStock,
            cTTotalItems,
            cTTimeTaken,
            timeTakenToProcessOrConstruct,
            tDec
        );
    }
    //else it's sent by us and they declined it so we don't care ?
}

export function sendToAdmin(
    bot: Bot,
    offer: i.TradeOffer,
    customInitializer: string,
    value: t.ValueDiff,
    itemList: string,
    keyPrices: KeyPrices,
    isOfferSent: boolean,
    isCustomPricer: boolean,
    cTKeyRate: string,
    autokeys: Autokeys,
    status: OverallStatus,
    slots: number,
    cTPureStock: string,
    cTTotalItems: string,
    cTTimeTaken: string,
    timeTakenToProcessOrConstruct: number,
    tSum: TradeSummary
): void {
    bot.messageAdmins(
        'trade',
        `${customInitializer ? customInitializer : '/me'} Trade #${
            offer.id
        } with ${offer.partner.getSteamID64()} is declined. ❌` +
            t.summarizeToChat(offer, bot, 'declined', false, value, keyPrices, true, isOfferSent) +
            (itemList !== '-' ? `\n\nItem lists:\n${itemList}` : '') +
            `\n\n${cTKeyRate} ${keyPrices.buy.toString()}/${keyPrices.sell.toString()}` +
            ` (${keyPrices.src === 'manual' ? 'manual' : isCustomPricer ? 'custom-pricer' : 'prices.tf'})` +
            `${
                autokeys.isEnabled
                    ? ' | Autokeys: ' +
                      (autokeys.getActiveStatus
                          ? '✅' +
                            (status.isBankingKeys ? ' (banking)' : status.isBuyingKeys ? ' (buying)' : ' (selling)')
                          : '🛑')
                    : ''
            }` +
            `\n${cTPureStock} ${t.pure.stock(bot).join(', ').toString()}` +
            `\n${cTTotalItems} ${bot.inventoryManager.getInventory.getTotalItems}${
                slots !== undefined ? `/${slots}` : ''
            }` +
            `\n${cTTimeTaken} ${t.convertTime(
                null,
                timeTakenToProcessOrConstruct,
                isOfferSent,
                tSum.showDetailedTimeTaken,
                tSum.showTimeTakenInMS
            )}` +
            `\n\nVersion ${process.env.BOT_VERSION}`,
        []
    );
}

interface Declined {
    //nonTf2Items: string[];
    highNotSellingItems: string[];
    overstocked: string[];
    understocked: string[];
    invalidItems: string[];
    disabledItems: string[];
    dupedItems: string[];
    reasonDescription: string;
}
